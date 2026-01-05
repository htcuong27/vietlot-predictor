export interface LotteryResult {
    id: string;
    date: string;
    result: string;
    termDate?: string;
    jackpot1?: number;
    jackpot2?: number;
}