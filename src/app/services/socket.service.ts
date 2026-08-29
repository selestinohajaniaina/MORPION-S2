import { Inject, Injectable, InjectionToken } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = new InjectionToken<string>('SOCKET_URL');

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  private socket!: Socket;
  private messageSubject = new Subject<any>();
  public message$ = this.messageSubject.asObservable();

  constructor(@Inject(SOCKET_URL) url: string) {
    this.socket = io(url);
    // Le listener est enregistré UNE SEULE FOIS, ici,
    // dès la création du service (donc au démarrage de l'app,
    // puisque providedIn: 'root' en fait un singleton)
    this.socket.on('state', (data) => {
      this.messageSubject.next(data);
    });
    this.socket.on('connect', () => console.log('Socket connecté'));
    this.socket.on('disconnect', () => console.log('Socket déconnecté'));
  }

  emit(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }

}
