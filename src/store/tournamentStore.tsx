import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type PropsWithChildren
} from "react";
import { loadTournamentState, saveTournamentState } from "../storage/persistence";
import { getMatchStartBlockingReasons } from "../scheduler/dynamicScheduler";
import {
  SCHEMA_VERSION,
  type Match,
  type Player,
  type TournamentConfig,
  type TournamentSettings,
  type TournamentState
} from "../types/tournament";

type ConfigurePayload = {
  config: TournamentConfig;
  players: Player[];
  matches: Match[];
  warnings: string[];
};

type FinishMatchPayload = {
  matchId: string;
  scoreA: number;
  scoreB: number;
};

type TournamentAction =
  | { type: "hydrate"; state: TournamentState }
  | { type: "configure"; payload: ConfigurePayload }
  | { type: "start_match"; matchId: string }
  | { type: "append_and_start_match"; match: Match }
  | { type: "undo_start"; matchId: string }
  | { type: "finish_match"; payload: FinishMatchPayload }
  | { type: "update_settings"; settings: Partial<TournamentSettings> }
  | { type: "import_state"; state: TournamentState }
  | { type: "reset" };

type TournamentStoreValue = {
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  isHydrated: boolean;
};

const TournamentContext = createContext<TournamentStoreValue | undefined>(undefined);

function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultTournamentSettings(): TournamentSettings {
  return {
    schedulingMode: "dynamic_fairness",
    showOverallRating: true,
    showOfficialStandings: true,
    showExplanatoryMetrics: true
  };
}

export function createEmptyTournamentState(): TournamentState {
  const now = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    players: [],
    matches: [],
    generationWarnings: [],
    settings: createDefaultTournamentSettings(),
    createdAt: now,
    updatedAt: now
  };
}

function migrateTournamentState(rawState: TournamentState): TournamentState {
  const fallback = createEmptyTournamentState();
  const legacyState = rawState as TournamentState & {
    schemaVersion?: number;
    settings?: Partial<TournamentSettings>;
    matches?: Array<Omit<Match, "matchType"> & Partial<Pick<Match, "matchType">>>;
  };

  return {
    ...fallback,
    ...legacyState,
    schemaVersion: SCHEMA_VERSION,
    players: legacyState.players ?? [],
    matches: (legacyState.matches ?? []).map((match) => ({
      ...match,
      matchType: match.matchType ?? "official"
    })),
    generationWarnings: legacyState.generationWarnings ?? [],
    settings: {
      ...createDefaultTournamentSettings(),
      ...(legacyState.settings ?? {})
    },
    createdAt: legacyState.createdAt ?? fallback.createdAt,
    updatedAt: legacyState.updatedAt ?? fallback.updatedAt
  };
}

function touch(state: TournamentState): TournamentState {
  return {
    ...state,
    updatedAt: nowIso()
  };
}

function ensureUniqueMatchId(match: Match, matches: Match[]): Match {
  if (!matches.some((existingMatch) => existingMatch.id === match.id)) return match;
  const prefix = match.matchType === "filler" ? "filler" : "match";
  let index = matches.length + 1;
  let id = `${prefix}-${index}`;
  while (matches.some((existingMatch) => existingMatch.id === id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }
  return { ...match, id };
}

function reducer(state: TournamentState, action: TournamentAction): TournamentState {
  switch (action.type) {
    case "hydrate":
      return migrateTournamentState(action.state);
    case "configure":
      return touch({
        ...state,
        schemaVersion: SCHEMA_VERSION,
        config: action.payload.config,
        players: action.payload.players,
        matches: action.payload.matches,
        generationWarnings: action.payload.warnings
      });
    case "start_match":
      if (
        getMatchStartBlockingReasons(
          state.matches.find((match) => match.id === action.matchId) ?? {
            id: action.matchId,
            teamA: ["", ""],
            teamB: ["", ""],
            status: "not_started",
            matchType: "official"
          },
          { matches: state.matches, players: state.players, courtCount: state.config?.courtCount ?? 0 }
        ).length > 0
      ) {
        return state;
      }
      return touch({
        ...state,
        matches: state.matches.map((match) =>
          match.id === action.matchId && match.status === "not_started"
            ? {
                ...match,
                status: "in_progress",
                startedAt: nowIso(),
                scoreA: undefined,
                scoreB: undefined,
                finishedAt: undefined
              }
            : match
        )
      });
    case "append_and_start_match": {
      const match = ensureUniqueMatchId(action.match, state.matches);
      const candidateState = {
        ...state,
        matches: [...state.matches, match]
      };
      const reasons = getMatchStartBlockingReasons(match, {
        matches: candidateState.matches,
        players: candidateState.players,
        courtCount: candidateState.config?.courtCount ?? 0
      });
      if (reasons.length > 0) return state;

      return touch({
        ...state,
        matches: [
          ...state.matches,
          {
            ...match,
            status: "in_progress",
            startedAt: nowIso(),
            scoreA: undefined,
            scoreB: undefined,
            finishedAt: undefined
          }
        ]
      });
    }
    case "undo_start":
      return touch({
        ...state,
        matches: state.matches.map((match) =>
          match.id === action.matchId && match.status === "in_progress" && match.scoreA === undefined && match.scoreB === undefined
            ? {
                ...match,
                status: "not_started",
                startedAt: undefined
              }
            : match
        )
      });
    case "finish_match":
      return touch({
        ...state,
        matches: state.matches.map((match) =>
          match.id === action.payload.matchId && match.status === "in_progress"
            ? {
                ...match,
                status: "finished",
                scoreA: action.payload.scoreA,
                scoreB: action.payload.scoreB,
                finishedAt: nowIso()
              }
            : match
        )
      });
    case "update_settings":
      return touch({
        ...state,
        settings: {
          ...state.settings,
          ...action.settings
        }
      });
    case "import_state":
      return touch(migrateTournamentState(action.state));
    case "reset":
      return createEmptyTournamentState();
    default:
      return state;
  }
}

export function TournamentProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, undefined, createEmptyTournamentState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    loadTournamentState()
      .then((storedState) => {
        if (active && storedState) {
          dispatch({ type: "hydrate", state: storedState });
        }
      })
      .finally(() => {
        if (active) setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    void saveTournamentState(state);
  }, [isHydrated, state]);

  const stableDispatch = useCallback<Dispatch<TournamentAction>>((action) => dispatch(action), []);

  const value = useMemo(
    () => ({
      state,
      dispatch: stableDispatch,
      isHydrated
    }),
    [isHydrated, stableDispatch, state]
  );

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
}

export function useTournamentStore(): TournamentStoreValue {
  const value = useContext(TournamentContext);
  if (!value) {
    throw new Error("useTournamentStore must be used within TournamentProvider");
  }
  return value;
}
