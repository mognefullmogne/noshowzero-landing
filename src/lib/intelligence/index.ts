// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Intelligence Layer — re-exports for convenience.
 *
 * Modules:
 *   - response-patterns: Patient response pattern learning
 *   - slot-recommendations: Smart scheduling suggestions
 *   - no-show-detector: Automatic no-show detection
 *   - overbooking: Overbooking recommendations
 */

export {
  recordResponsePattern,
  getOptimalContactTime,
  getAvgResponseMinutes,
  computeOptimalFromRecords,
} from "./response-patterns";

export type {
  ResponseRecord,
  ResponsePatterns,
  OptimalContactTime,
} from "./response-patterns";

export {
  getSlotRecommendations,
  getSlotRiskLabel,
  annotateSlots,
} from "./slot-recommendations";

export type {
  SlotRecommendation,
  SlotRiskLabel,
  AnnotatedSlot,
} from "./slot-recommendations";

export {
  detectNoShows,
  detectNoShowsAllTenants,
} from "./no-show-detector";

export type {
  DetectNoShowsResult,
} from "./no-show-detector";

export {
  getOverbookingRecommendations,
} from "./overbooking";

export type {
  OverbookingRecommendation,
} from "./overbooking";
