import { simulateFixtureFootysim } from './footysimBridge';
import type { Team } from '../types';

self.onmessage = (e: MessageEvent<{ homeTeam: Team; awayTeam: Team; seed: number; knockout?: boolean }>) => {
  const { homeTeam, awayTeam, seed, knockout } = e.data;
  const result = simulateFixtureFootysim(homeTeam, awayTeam, seed, { knockout });
  self.postMessage(result);
};
