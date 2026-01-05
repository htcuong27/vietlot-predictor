import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class InteractionService {
  // Signal to hold numbers to be checked in Jackpot Checker
  checkNumbers = signal<number[] | null>(null);

  sendToChecker(numbers: number[]) {
    this.checkNumbers.set([...numbers].sort((a, b) => a - b));
    
    // Smooth scroll to Jackpot Checker
    setTimeout(() => {
      const element = document.querySelector('app-history-search');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }
}
