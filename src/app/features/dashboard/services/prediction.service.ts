import { Injectable } from '@angular/core';
import { AlgorithmType } from '../models/algorithm';
import { LotteryResult } from '../models/lottery';
import { AiService } from '../../../core/services/ai.service';

@Injectable({
    providedIn: 'root'
})
export class PredictionService {

    constructor(private aiService: AiService) { }

    async predict(algorithm: AlgorithmType, history: LotteryResult[], product: '645' | '655', targetScore?: number): Promise<{ numbers: number[], explanation: string }> {
        const maxNumber = product === '645' ? 45 : 55;

        switch (algorithm) {
            case 'random':
                return this.generateRandom(maxNumber);
            case 'hot':
                return this.generateByFrequency(history, maxNumber, 'hot');
            case 'cold':
                return this.generateByFrequency(history, maxNumber, 'cold');
            case 'balanced':
                return this.generateBalanced(history, maxNumber);
            case 'targetScore':
                return this.generateByTargetScore(targetScore || 80, history, maxNumber);
            case 'pairAnalysis':
                return this.generateByPairs(history, maxNumber);
            case 'lastDigit':
                return this.generateByLastDigit(history, maxNumber);
            case 'csprng':
                return this.generateCSPRNG(maxNumber);
            case 'vrf':
                return this.generateVRF(maxNumber);
            default:
                return this.generateRandom(maxNumber);
        }
    }

    // Generate multiple predictions for target score mode
    async predictMultiple(algorithm: AlgorithmType, history: LotteryResult[], product: '645' | '655', count: number = 1, targetScore?: number): Promise<{ numbers: number[], score: number, explanation: string }[]> {
        const results: { numbers: number[], score: number, explanation: string }[] = [];

        if (algorithm === 'targetScore' && targetScore) {
            // Try to find best matches
            let attempts = 0;
            const maxAttempts = 200; // Don't freeze UI

            while (results.length < count && attempts < maxAttempts) {
                // Mix strategies based on target score
                let strategy = 'random';
                if (targetScore >= 80) {
                    // For high scores, we need hot numbers
                    const rand = Math.random();
                    if (rand > 0.6) strategy = 'hot';
                    else if (rand > 0.3) strategy = 'balanced';
                    else strategy = 'random'; // Still keep some randomness
                } else if (targetScore >= 60) {
                    strategy = Math.random() > 0.5 ? 'balanced' : 'random';
                }

                let prediction: { numbers: number[], explanation: string };
                if (strategy === 'random') prediction = this.generateRandom(product === '645' ? 45 : 55);
                else if (strategy === 'balanced') prediction = this.generateBalanced(history, product === '645' ? 45 : 55);
                else if (strategy === 'hot') prediction = this.generateByFrequency(history, product === '645' ? 45 : 55, 'hot');
                else prediction = this.generateRandom(product === '645' ? 45 : 55);

                const nums = prediction.numbers;
                const score = this.calculateScore(nums, history);

                // Accept if within range (e.g. +/- 5)
                if (Math.abs(score - targetScore) <= 5) {
                    // Check uniqueness
                    const isUnique = !results.some(r => r.numbers.join('-') === nums.join('-'));
                    if (isUnique) {
                        results.push({
                            numbers: nums,
                            score,
                            explanation: `Score ${score} is close to target ${targetScore}. ${prediction.explanation}`
                        });
                    }
                }
                attempts++;
            }

            // If not enough, just fill with closest (could be improved)
            if (results.length < count) {
                // Fill with randoms if we fail to find target scores
                const remaining = count - results.length;
                for (let i = 0; i < remaining; i++) {
                    const p = this.generateRandom(product === '645' ? 45 : 55);
                    results.push({
                        numbers: p.numbers,
                        score: this.calculateScore(p.numbers, history),
                        explanation: p.explanation
                    });
                }
            }

            return results.sort((a, b) => Math.abs(a.score - targetScore) - Math.abs(b.score - targetScore));
        }

        if (algorithm === 'ai') {
            const predictions = this.aiService.generatePrediction(count, product);
            return predictions;
        }
        // Normal single prediction repeated
        for (let i = 0; i < count; i++) {
            const prediction = await this.predict(algorithm, history, product);
            results.push({
                numbers: prediction.numbers,
                score: this.calculateScore(prediction.numbers, history),
                explanation: prediction.explanation
            });
        }
        return results;
    }

    calculateScore(numbers: number[], history: LotteryResult[]): number {
        if (!numbers || numbers.length !== 6) return 0;

        // 1. Frequency Score (40%)
        const recentHistory = history.slice(0, 100);
        const frequencies = this.getFrequencies(recentHistory);
        let freqScore = 0;
        numbers.forEach(n => {
            const freq = frequencies[n] || 0;
            freqScore += freq;
        });
        const normalizedFreqScore = Math.min((freqScore / 80) * 40, 40);

        // 2. Spread Score (30%)
        const evens = numbers.filter(n => n % 2 === 0).length;
        const evenOddScore = (3 - Math.abs(3 - evens)) * 5;

        const maxNum = 45;
        const lowHighBoundary = maxNum / 2;
        const lows = numbers.filter(n => n <= lowHighBoundary).length;
        const highLowScore = (3 - Math.abs(3 - lows)) * 5;

        const spreadScore = evenOddScore + highLowScore;

        // 3. Sum Score (30%)
        const sum = numbers.reduce((a, b) => a + b, 0);
        let sumScore = 0;
        if (sum >= 100 && sum <= 200) sumScore = 30;
        else if (sum >= 80 && sum <= 220) sumScore = 20;
        else if (sum >= 60 && sum <= 240) sumScore = 10;

        const result = normalizedFreqScore + spreadScore + sumScore;

        return Math.round(result >= 100 ? 99 : result);
    }

    private generateRandom(max: number): { numbers: number[], explanation: string } {
        const nums = new Set<number>();
        while (nums.size < 6) {
            nums.add(Math.floor(Math.random() * max) + 1);
        }
        return {
            numbers: Array.from(nums).sort((a, b) => a - b),
            explanation: 'Randomly generated set with no specific bias.'
        };
    }

    private generateByFrequency(history: LotteryResult[], max: number, type: 'hot' | 'cold'): { numbers: number[], explanation: string } {
        // Use recent history (100 draws) for 'hot' to match scoring logic
        const sampleHistory = history.slice(0, 100);
        const frequencies = this.getFrequencies(sampleHistory);
        const sortedNums = Object.keys(frequencies).map(Number).sort((a, b) => {
            return type === 'hot' ? frequencies[b] - frequencies[a] : frequencies[a] - frequencies[b];
        });

        const candidates = sortedNums.slice(0, 15);
        const result = this.shuffle(candidates).slice(0, 6).sort((a, b) => a - b);

        return {
            numbers: result,
            explanation: type === 'hot'
                ? `Contains high frequency numbers`
                : `Contains low frequency numbers`
        };
    }

    private generateBalanced(history: LotteryResult[], max: number): { numbers: number[], explanation: string } {
        const hotResult = this.generateByFrequency(history, max, 'hot');
        const hot = hotResult.numbers.slice(0, 3);
        const randomResult = this.generateRandom(max);
        const combined = new Set([...hot, ...randomResult.numbers]);
        while (combined.size < 6) {
            combined.add(Math.floor(Math.random() * max) + 1);
        }
        const result = Array.from(combined).slice(0, 6).sort((a, b) => a - b);

        return {
            numbers: result,
            explanation: 'Balanced mix: 3 hot numbers and 3 random numbers.'
        };
    }

    private generateByTargetScore(target: number, history: LotteryResult[], max: number): { numbers: number[], explanation: string } {
        // Simple attempt: generate random until close
        let bestNums: number[] = [];
        let bestDiff = 100;
        let bestScore = 0;

        for (let i = 0; i < 50; i++) {
            const nums = this.generateRandom(max).numbers;
            const score = this.calculateScore(nums, history);
            const diff = Math.abs(score - target);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestNums = nums;
                bestScore = score;
            }
            if (diff === 0) break;
        }
        return {
            numbers: bestNums,
            explanation: `Generated to match target score ${target}. Actual score: ${bestScore}.`
        };
    }

    private generateByPairs(history: LotteryResult[], max: number): { numbers: number[], explanation: string } {
        // Find most frequent pairs in recent history
        const pairFreqs: { [key: string]: number } = {};
        const recent = history.slice(0, 200); // Analyze last 200 draws

        recent.forEach(draw => {
            if (draw.result) {
                // Robust parsing: handle comma, hyphen, and ensure numbers
                const nums = draw.result.split(/[,-]/)
                    .map(s => s.trim())
                    .filter(s => s && !isNaN(Number(s)))
                    .map(Number)
                    .sort((a, b) => a - b);

                if (nums.length >= 2) {
                    for (let i = 0; i < nums.length; i++) {
                        for (let j = i + 1; j < nums.length; j++) {
                            const key = `${nums[i]}-${nums[j]}`;
                            pairFreqs[key] = (pairFreqs[key] || 0) + 1;
                        }
                    }
                }
            }
        });

        // Sort pairs by frequency
        const sortedPairs = Object.entries(pairFreqs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20) // Top 20 pairs
            .map(entry => entry[0].split('-').map(Number));

        if (sortedPairs.length === 0) return this.generateRandom(max);

        // Pick a random top pair to start
        const startPair = sortedPairs[Math.floor(Math.random() * sortedPairs.length)];
        const result = new Set<number>(startPair);

        // Fill rest with high frequency numbers that fit well
        const hotNums = this.generateByFrequency(history, max, 'hot').numbers;

        for (const num of hotNums) {
            if (result.size >= 6) break;
            result.add(num);
        }

        // If still not enough, add random
        while (result.size < 6) {
            result.add(Math.floor(Math.random() * max) + 1);
        }

        return {
            numbers: Array.from(result).sort((a, b) => a - b),
            explanation: `Built around frequent pair ${startPair.join('-')} and hot numbers.`
        };
    }

    private generateByLastDigit(history: LotteryResult[], max: number): { numbers: number[], explanation: string } {
        // Analyze last digit frequency
        const digitFreqs: { [key: number]: number } = {};
        const recent = history.slice(0, 100);

        recent.forEach(draw => {
            if (draw.result) {
                const nums = draw.result.split(/[,-]/)
                    .map(s => s.trim())
                    .filter(s => s && !isNaN(Number(s)))
                    .map(Number);

                nums.forEach(n => {
                    const lastDigit = n % 10;
                    digitFreqs[lastDigit] = (digitFreqs[lastDigit] || 0) + 1;
                });
            }
        });

        // Get top 3 lucky digits
        const luckyDigits = Object.entries(digitFreqs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(entry => Number(entry[0]));

        if (luckyDigits.length === 0) return this.generateRandom(max);

        // Filter numbers that end with these digits
        const candidates: number[] = [];
        for (let i = 1; i <= max; i++) {
            if (luckyDigits.includes(i % 10)) {
                candidates.push(i);
            }
        }

        // Shuffle and pick
        const result = this.shuffle(candidates).slice(0, 6);

        // If not enough (rare), fill with random
        const finalSet = new Set(result);
        while (finalSet.size < 6) {
            finalSet.add(Math.floor(Math.random() * max) + 1);
        }

        return {
            numbers: Array.from(finalSet).sort((a, b) => a - b),
            explanation: `Prioritized numbers ending in lucky digits: ${luckyDigits.join(', ')}.`
        };
    }

    private getFrequencies(history: LotteryResult[]): { [key: number]: number } {
        const freqs: { [key: number]: number } = {};
        history.forEach(draw => {
            if (draw.result) {
                // Robust parsing to avoid NaN
                const nums = draw.result.split(/[,-]/)
                    .map(s => s.trim())
                    .filter(s => s && !isNaN(Number(s)))
                    .map(Number);

                nums.forEach(n => freqs[n] = (freqs[n] || 0) + 1);
            }
        });
        for (let i = 1; i <= 55; i++) {
            if (!freqs[i]) freqs[i] = 0;
        }
        return freqs;
    }

    private shuffle(array: number[]): number[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private generateCSPRNG(max: number): { numbers: number[], explanation: string } {
        const nums = new Set<number>();
        const array = new Uint32Array(1);

        while (nums.size < 6) {
            window.crypto.getRandomValues(array);
            // Use modulo to get range 1-max. Note: slight modulo bias exists but negligible for this range/purpose
            const val = (array[0] % max) + 1;
            nums.add(val);
        }

        return {
            numbers: Array.from(nums).sort((a, b) => a - b),
            explanation: 'Generated using Cryptographically Secure Pseudo-Random Number Generator (CSPRNG).'
        };
    }

    private generateVRF(max: number): { numbers: number[], explanation: string } {
        // Simulation of VRF: Seed + Hash -> Randomness
        // In a real app, the seed would come from the block hash or user input
        const seed = Date.now().toString() + Math.random().toString();
        const nums = new Set<number>();
        let counter = 0;

        // Simple hash function simulation (DJB2 or similar for demo, or just use Math.random seeded conceptually)
        // For a better "simulation", we can use SHA-256 via SubtleCrypto, but that's async.
        // To keep it sync for this service structure, we'll use a pseudo-random generator seeded by a hash.

        // Let's use a simple seeded random for the "VRF" effect
        // A simple LCG (Linear Congruential Generator) seeded by the "hash"
        let hashVal = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hashVal = ((hashVal << 5) - hashVal) + char;
            hashVal = hashVal & hashVal; // Convert to 32bit integer
        }

        let state = Math.abs(hashVal);

        // Linear Congruential Generator (LCG) using constants from Numerical Recipes.
        // Formula: state = (state * multiplier + increment) % modulus
        // This provides a simple, deterministic pseudo-random sequence based on the initial seed state.
        const nextRand = () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };

        while (nums.size < 6) {
            const val = Math.floor(nextRand() * max) + 1;
            nums.add(val);
        }

        return {
            numbers: Array.from(nums).sort((a, b) => a - b),
            explanation: `Simulated Chainlink VRF. Deterministic generation from seed: ${seed.substring(0, 10)}...`
        };
    }
}
