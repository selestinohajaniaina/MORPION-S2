import { Bot } from "../bot/bot";
import { Manche } from "../manche/manche";
import { Player } from "../player/player";

export class Partie {

    private id!: number;

    public player!: Player;
    public bot!: Bot;
    public playerScore!: number;
    public botScore!: number;
    public nullScore!: number;
    public manche!: Manche[];

    constructor(PLAYER: Player, BOT: Bot) {
        this.id = this.generateID();
        this.player = PLAYER;
        this.bot = BOT;
        this.manche = [];
    }

    private generateID(): number {
        return Math.floor(Math.random() * (1000));
    }

    public getId(): number {
        return this.id;
    }

}
