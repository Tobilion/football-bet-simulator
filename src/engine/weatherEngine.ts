import { WeatherCondition, WeatherModifiers } from "../types";

export const WEATHER_CONDITIONS: { condition: WeatherCondition, weight: number }[] = [
  { condition: "Clear Sky",    weight: 30 },
  { condition: "Overcast",     weight: 18 },
  { condition: "Light Rain",   weight: 16 },
  { condition: "Heavy Rain",   weight: 10 },
  { condition: "Thunderstorm", weight: 5  },
  { condition: "Blizzard",     weight: 5  },
  { condition: "Heatwave",     weight: 6  },
  { condition: "Fierce Wind",  weight: 5  },
  { condition: "Fierce Derby", weight: 5  } // Selected by rivalry logic
];

export function selectMatchWeather(isDerby: boolean): WeatherCondition {
  if (isDerby) {
    return "Fierce Derby";
  }

  const rand = Math.random() * 100;
  let acc = 0;
  for (const w of WEATHER_CONDITIONS) {
    acc += w.weight;
    if (rand <= acc) {
      return w.condition;
    }
  }
  return "Clear Sky";
}

export function getWeatherModifiers(condition: WeatherCondition): WeatherModifiers {
  switch (condition) {
    case "Clear Sky":
      return { condition, yellowCardMultiplier: 1.0, goalProbabilityMultiplier: 1.0, foulRateMultiplier: 1.0, volatilityMultiplier: 1.0 };
    case "Overcast":
      return { condition, yellowCardMultiplier: 1.0, goalProbabilityMultiplier: 0.98, foulRateMultiplier: 1.0, volatilityMultiplier: 1.0 };
    case "Light Rain":
      return { condition, yellowCardMultiplier: 1.15, goalProbabilityMultiplier: 0.90, foulRateMultiplier: 1.05, volatilityMultiplier: 1.10 };
    case "Heavy Rain":
      return { condition, yellowCardMultiplier: 1.35, goalProbabilityMultiplier: 0.75, foulRateMultiplier: 1.20, volatilityMultiplier: 1.30 };
    case "Thunderstorm":
      return { condition, yellowCardMultiplier: 1.10, goalProbabilityMultiplier: 0.60, foulRateMultiplier: 1.15, volatilityMultiplier: 1.50 };
    case "Blizzard":
      return { condition, yellowCardMultiplier: 1.10, goalProbabilityMultiplier: 0.65, foulRateMultiplier: 1.35, volatilityMultiplier: 1.45 };
    case "Heatwave":
      return { condition, yellowCardMultiplier: 1.20, goalProbabilityMultiplier: 1.05, foulRateMultiplier: 1.15, volatilityMultiplier: 1.20 };
    case "Fierce Wind":
      return { condition, yellowCardMultiplier: 1.0, goalProbabilityMultiplier: 0.85, foulRateMultiplier: 1.10, volatilityMultiplier: 1.30 };
    case "Fierce Derby":
      return { condition, yellowCardMultiplier: 2.0, goalProbabilityMultiplier: 1.0, foulRateMultiplier: 1.50, volatilityMultiplier: 2.0, isRivalryDerby: true };
    default:
      return { condition, yellowCardMultiplier: 1.0, goalProbabilityMultiplier: 1.0, foulRateMultiplier: 1.0, volatilityMultiplier: 1.0 };
  }
}
