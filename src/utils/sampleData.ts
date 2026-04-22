import type { Gender, Player } from "../types/tournament";
import { createPlayerId } from "./ids";

const SAMPLE_PLAYERS: Array<{ name: string; gender: Gender }> = [
  { name: "Song", gender: "male" },
  { name: "Ziyang", gender: "male" },
  { name: "Stephen", gender: "male" },
  { name: "Aaron", gender: "male" },
  { name: "John Lee", gender: "male" },
  { name: "Jacky", gender: "male" },
  { name: "Andy", gender: "male" },
  { name: "Nishant", gender: "male" },
  { name: "李波波", gender: "female" },
  { name: "秦思", gender: "female" },
  { name: "庄", gender: "other" },
  { name: "Mia", gender: "female" },
  { name: "Leo", gender: "male" },
  { name: "Ivy", gender: "female" },
  { name: "Chen", gender: "other" },
  { name: "Grace", gender: "female" }
];

export function createBlankPlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, index) => ({
    id: createPlayerId(index),
    name: "",
    gender: "other"
  }));
}

export function createSamplePlayers(count: number, offset = 0): Player[] {
  return Array.from({ length: count }, (_, index) => {
    const sample = SAMPLE_PLAYERS[(index + offset) % SAMPLE_PLAYERS.length];
    const suffix = index >= SAMPLE_PLAYERS.length ? ` ${Math.floor(index / SAMPLE_PLAYERS.length) + 1}` : "";
    return {
      id: createPlayerId(index),
      name: `${sample.name}${suffix}`,
      gender: sample.gender
    };
  });
}
