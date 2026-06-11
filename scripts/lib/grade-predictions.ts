/**
 * Deterministic grading for meta-report predictions.
 *
 * The narrative model proposes falsifiable usage calls each month; this module
 * grades last month's calls against the new Smogon data. The model NEVER
 * grades itself — grades are pure arithmetic on the stored baseline vs the
 * latest usage, and the published "Last month's calls" table renders only
 * these results.
 */

export interface Prediction {
    /** Report month (YYYY-MM) the prediction was published in. */
    month: string;
    /** Format slug the prediction belongs to ("champions", "vgc", "ou"). */
    slug: string;
    pokemonId: string;
    pokemonName: string;
    /** Human-readable claim as published. */
    claim: string;
    direction: "up" | "down";
    /** Usage-point move required for the call to count as correct. */
    thresholdPts: number;
    confidence: "likely" | "possible";
    /** What outcome proves the call wrong — published alongside the claim. */
    falsifier: string;
    /** The data line the model cited as evidence when making the call. */
    evidence: string;
    /** Usage (percent points, 0-100) at the time the call was made. */
    baselineUsagePct: number;
}

export type PredictionGrade = "correct" | "wrong" | "unclear";

export interface GradedPrediction extends Prediction {
    grade: PredictionGrade;
    /** Usage (percent points) in the grading month; 0 if absent from the data. */
    actualUsagePct: number;
    deltaPts: number;
}

/**
 * Grade predictions against the latest usage data.
 *
 * - moved the predicted direction by >= thresholdPts -> correct
 * - moved the opposite direction (or not at all)     -> wrong
 * - moved the predicted direction but < thresholdPts -> unclear
 *
 * A Pokémon absent from the latest data counts as 0% usage — dropping out
 * entirely is a real outcome, not a grading gap.
 */
export function gradePredictions(
    predictions: Prediction[],
    latestUsagePct: Map<string, number>,
): GradedPrediction[] {
    return predictions.map((prediction) => {
        const actualUsagePct = latestUsagePct.get(prediction.pokemonId) ?? 0;
        const deltaPts = actualUsagePct - prediction.baselineUsagePct;
        const signed = prediction.direction === "up" ? deltaPts : -deltaPts;

        let grade: PredictionGrade;
        if (signed >= prediction.thresholdPts) grade = "correct";
        else if (signed <= 0) grade = "wrong";
        else grade = "unclear";

        return { ...prediction, grade, actualUsagePct, deltaPts };
    });
}
