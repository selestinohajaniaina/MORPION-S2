import { Component, OnInit, ViewChild } from '@angular/core';
import { Manche } from '../class/manche/manche';
import { AlertController, IonModal, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpService } from '../services/http.service';
import { SocketService } from '../services/socket.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-game-multi',
  templateUrl: './game-multi.page.html',
  styleUrls: ['./game-multi.page.scss'],
})
export class GameMultiPage implements OnInit {
  @ViewChild('modal') modal!: IonModal;

  public player!: 'X' | 'O';
  public playerName!: string;
  public opponentName!: string;
  public opponentScore: number = 0;
  public playerScore: number = 0;
  public nullScore: number = 0;
  public manche!: Manche;
  public theTour!: 'you' | 'opponent';
  public status: 'win' | 'lose' | null = null;
  public board: ('X' | 'O' | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];

  private adress!: string;
  private port!: number;
  private socketService!: SocketService;
  private destroy$ = new Subject<void>();
  private audio = new Audio('assets/win.mp3');

  constructor(
    private alert: AlertController,
    private toast: ToastController,
    private router: Router,
    private server: HttpService
  ) {}

  ngOnInit() {}

  ionViewDidEnter() {
    this.getPayer();
  }

  getPayer() {
    this.manche = new Manche();
    const serverConfig = localStorage.getItem('serverConfig');
    const _player = localStorage.getItem('player');
    if (serverConfig) {
      const setup = JSON.parse(serverConfig);
      this.player = setup.pion == 5 ? 'X' : 'O';
      this.adress = setup.adress;
      this.port = setup.port;
      this.listenSocket();
    }
    if (_player) {
      const _playerJson = JSON.parse(_player);
      this.playerName = _playerJson.name;
    }
  }

  async choose(row: number, col: number) {
    console.log('choose', row, col, this.board[row][col]);

    if (this.board[row][col] == null) {
      this.playerChoose(row, col);
    } else {
      const alert = await this.alert.create({
        message: 'Choisis un autre parmit les cases vide',
        buttons: ['ok'],
      });
      alert.present();
    }
  }

  playerChoose(row: number, col: number) {
    if (this.theTour == 'opponent') return;
    this.theTour = 'you';
    this.server
      .move(this.player, row, col, `${this.adress}:${this.port}`)
      .subscribe((res) => {
        console.log('res', res);
      });
  }

  async leave() {
    const alert = await this.alert.create({
      message: 'Voullez-vous vraiment quitter la partie?',
      buttons: [
        {
          text: 'Rester',
        },
        {
          text: 'Quiter',
          cssClass: 'secondary',
          handler: () => {
            this.router.navigate(['/setup']);
          },
        },
      ],
    });
    alert.present();
  }

  getOpponent(myPlayer: 'X' | 'O'): 'X' | 'O' {
    return myPlayer == 'O' ? 'X' : 'O';
  }

  listenSocket() {
    this.socketService = new SocketService(`${this.adress}:${this.port}`);
    this.socketService.message$
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        const { board, players, log, currentPlayer, winner } = data;
        const opponent = players[this.getOpponent(this.player)];

        if (opponent.connected) {
          this.opponentName = opponent.name;
        }
        this.board = board;
        this.theTour = currentPlayer == this.player ? 'you' : 'opponent';

        if (winner) {
          this.openModal();
          this.status = this.player == winner ? 'win' : 'lose';
          this.audio.play();
        }

        console.log('State', data);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async openModal(): Promise<void> {
    await this.modal.present();
  }

  async closeModal(): Promise<void> {
    await this.modal.dismiss();
  }

  async showMessage(msg: string, title: string = '') {
    const alert = await this.toast.create({
      message: msg,
      duration: 1500,
    });
    await alert.present();
  }
}
