import { Inject, Injectable } from '@angular/core';
// import { GoogleGenAI } from '@google/genai';
// import { environment } from '../../../environments/environment';
import { LotteryResult } from '../../features/dashboard/models/lottery';
import createLotto from 'lotto-draw';


@Injectable({
    providedIn: 'root'
})
export class AiService {
    // private genAI: GoogleGenAI;
    // private apiKey = environment.geminiAPI;
    // private modelId = 'gemini-2.5-flash';
    private lotto = createLotto();
    private isCreated = false;

    constructor() {
        // this.genAI = new GoogleGenAI({ apiKey: this.apiKey });

    }

    generateLotto(product: '645' | '655') {
        if (this.isCreated) {
            return;
        }
        const maxNum = product === '645' ? 45 : 55;
        for (let i = 1; i <= maxNum; i++) {
            this.lotto.add(i);
        }
        this.isCreated = true;
    }

    hasKey(): boolean {
        // return !!this.apiKey;
        return true;
    }

    // async generatePrediction(history: LotteryResult[], product: '645' | '655', count: number = 5): Promise<{ numbers: number[], explanation: string, score: number }[]> {
    //     if (!this.apiKey) {
    //         throw new Error('Please provide a Gemini API Key in settings.');
    //     }

    //     const maxNum = product === '645' ? 45 : 55;
    //     const recentHistory = history.slice(0, 20).map(h => h.result).join(' | ');

    //     const prompt = `
    //         Act as a statistician. Analyze these recent Vietlott ${product} lottery results:
    //         ${recentHistory}

    //         Predict the next set of 6 numbers (1-${maxNum}) with ${count} times. 
    //         Score should be between 0 and 100.
    //         Provide the result in valid JSON format ONLY:
    //         [{
    //             "numbers": [n1, n2, n3, n4, n5, n6],
    //             "score": 100,
    //             "explanation": "Brief 1-sentence analytical reason."
    //         }, {
    //                     "numbers": [n1, n2, n3, n4, n5, n6],
    //                     "score": 100,
    //                     "explanation": "Brief 1-sentence analytical reason."
    //         }, {
    //                     "numbers": [n1, n2, n3, n4, n5, n6],
    //                     "score": 100,
    //                     "explanation": "Brief 1-sentence analytical reason."
    //         }, {
    //                     "numbers": [n1, n2, n3, n4, n5, n6],
    //                     "score": 100,
    //                     "explanation": "Brief 1-sentence analytical reason."
    //         }, {
    //                     "numbers": [n1, n2, n3, n4, n5, n6],
    //                     "score": 100,
    //                     "explanation": "Brief 1-sentence analytical reason."
    //         }]
    //     `;

    //     try {
    //         const response = await this.genAI.models.generateContent({
    //             model: this.modelId,
    //             contents: prompt,
    //             config: {
    //                 responseMimeType: 'application/json',
    //                 responseSchema: {
    //                     type: 'array',
    //                     items: {
    //                         type: 'object',
    //                         properties: {
    //                             numbers: {
    //                                 type: 'array',
    //                                 items: {
    //                                     type: 'integer'
    //                                 }
    //                             },
    //                             score: {
    //                                 type: 'integer'
    //                             },
    //                             explanation: {
    //                                 type: 'string'
    //                             }
    //                         },
    //                         required: ['numbers', 'score', 'explanation']
    //                     }
    //                 }
    //             }
    //         });

    //         if (!response.text) {
    //             throw new Error('Response is not text');
    //         }

    //         const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    //         const json = JSON.parse(text);

    //         return json.map((item: any) => ({
    //             numbers: item.numbers.sort((a: number, b: number) => a - b),
    //             explanation: item.explanation || 'AI generated prediction.',
    //             score: item.score || 0
    //         }));
    //     } catch (error) {
    //         console.error('AI Prediction Error:', error);
    //         // Fallback

    //         const result = Array(count).fill({
    //             numbers: this.generateRandom(maxNum, product),
    //             explanation: 'AI Service unavailable. Falling back to random.',
    //             score: 0
    //         });
    //         return result;
    //     }


    // }

    generatePrediction(count: number = 5, product: '645' | '655'): { numbers: number[], explanation: string, score: number }[] {
        this.generateLotto(product);
        const result: { numbers: number[], explanation: string, score: number }[] = [];
        for (let i = 0; i < count; i++) {
            const numbers = this.generateRandom()
            result.push({
                numbers: (numbers.length === 5 ? [...numbers, Math.round(Math.random() * (product === '645' ? 45 : 55))] : numbers).sort((a, b) => a - b),
                explanation: 'AI generated prediction.',
                score: Math.round(Math.random() * 100)
            });
        }
        return result;
    }

    generatePointNumbers(product: '645' | '655') {
        this.generateLotto(product);
        const result = this.generateRandom();
        while (result.length < 6 || new Set(result).size < 6) {
            result.push(Math.round(Math.random() * (product === '645' ? 45 : 55)));
        }
        return result;
    }



    // async analyzePatternPoints(points: { x: number, y: number }[], width: number, height: number, product: string): Promise<{ shape: string, nextPoints: { x: number, y: number }[] }> {
    //     if (!this.apiKey) {
    //         throw new Error('Please provide a Gemini API Key.');
    //     }

    //     const pointsStr = JSON.stringify(points);
    //     const prompt = `
    //             Analyze this set of 2D points on a ${width}x${height} grid representing a lottery pattern:
    //             ${pointsStr}

    //             Identify the shape/trend. Predict the next 6 points that would continue this pattern.
    //             Return JSON ONLY:
    //             {
    //                 "shape": "visualization description",
    //                 "nextPoints": [{"x": 1, "y": 2}, ...]
    //             }
    //             Do not include markdown.
    //     `;

    //     try {
    //         const response = await this.genAI.models.generateContent({
    //             model: this.modelId,
    //             contents: prompt
    //         });

    //         if (!response.text) {
    //             throw new Error('Response is not text');
    //         }

    //         const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    //         return JSON.parse(text);
    //     } catch (error) {
    //         console.error('AI Pattern Error:', error);
    //         const result = Array(6).fill({
    //             numbers: this.generateRandom(product),
    //             explanation: 'AI Service unavailable. Falling back to random.',
    //             score: 0
    //         });
    //         return { shape: 'Unknown', nextPoints: result };
    //     }
    // }

    generateRandom(quantity: number = 6): number[] {
        const picked = this.lotto.drawMultiple(quantity, { unique: true });
        return picked;
    }
}
