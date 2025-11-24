import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { LotteryResult } from '../models/lottery';
import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class LotteryService {
    private readonly API_BASE = environment.vietlottApiUrl;

    // Private writable signals
    private _results645 = signal<LotteryResult[]>([]);
    private _results655 = signal<LotteryResult[]>([]);

    // Public readonly signals
    readonly results645 = this._results645.asReadonly();
    readonly results655 = this._results655.asReadonly();

    // Computed signals for latest results
    readonly latest645 = computed(() => this._results645()[0] || null);
    readonly latest655 = computed(() => this._results655()[0] || null);

    constructor(private http: HttpClient) {
        this.loadInitialData();
    }

    private loadInitialData() {
        this.loadProductData('645', this._results645, 1);
        this.loadProductData('655', this._results655, 2);
    }

    refresh(product: '645' | '655') {
        if (product === '645') {
            this.checkForUpdates(1, this._results645(), this._results645);
        } else {
            this.checkForUpdates(2, this._results655(), this._results655);
        }
    }

    private loadProductData(product: string, signalRef: any, productId: number) {
        this.http.get<any[]>(`assets/data/${product}.json`).subscribe({
            next: (data) => {
                const results = Array.isArray(data) ? data : (data as any).result || [];
                const processed = this.processResults(results);
                signalRef.set(processed);
                this.checkForUpdates(productId, processed, signalRef);
            },
            error: (err) => console.error(`Failed to load ${product} data`, err)
        });
    }

    private processResults(data: any[]): LotteryResult[] {
        return data.map(item => {
            let j1 = 0;
            let j2 = 0;

            if (item.statistical && Array.isArray(item.statistical) && item.statistical.length > 0) {
                // Parse "12.345.678.900" -> 12345678900
                const parseValue = (val: string) => Number(val.replace(/\./g, ''));

                if (item.statistical[0] && item.statistical[0].giatrigiai) {
                    j1 = parseValue(item.statistical[0].giatrigiai);
                }

                // For 6/55, Jackpot 2 is usually the second item
                if (item.statistical[1] && item.statistical[1].giatrigiai && item.statistical[1].giaithuong.includes('Jackpot 2')) {
                    j2 = parseValue(item.statistical[1].giatrigiai);
                }
            }

            // Fallback to top-level if statistical is missing (backward compatibility or API variation)
            if (j1 === 0 && item.jackpot1) j1 = Number(item.jackpot1);
            if (j2 === 0 && item.jackpot2) j2 = Number(item.jackpot2);

            return {
                id: String(item.id),
                date: item.date,
                result: item.result,
                jackpot1: j1,
                jackpot2: j2
            };
        }).sort((a, b) => Number(b.id) - Number(a.id));
    }

    private checkForUpdates(productId: number, currentResults: LotteryResult[], signalRef: any) {
        if (currentResults.length === 0) return;

        const lastId = Number(currentResults[0].id);
        // Fetch next few draws to see if there are updates
        const fromId = lastId + 1;
        const toId = fromId + 10; // Check next 10 draws

        this.fetchFromApi(productId, fromId, toId).subscribe(newResults => {
            if (newResults.length > 0) {
                const processed = this.processResults(newResults);
                // Merge and sort
                const updated = [...processed, ...currentResults]
                    .sort((a, b) => Number(b.id) - Number(a.id));

                // Remove duplicates if any (just in case)
                const unique = Array.from(new Map(updated.map(item => [item.id, item])).values());

                signalRef.set(unique);

                // Persist latest ID for reference if needed
                localStorage.setItem(`latestId_${productId}`, unique[0].id);
            }
        });
    }

    private fetchFromApi(productId: number, fromId: number, toId: number): Observable<any[]> {
        const url = `${this.API_BASE}?productid=${productId}&fromid=${fromId}&toid=${toId}`;
        return this.http.get<any>(url).pipe(
            map(res => res.result || []),
            catchError(() => of([]))
        );
    }
}
