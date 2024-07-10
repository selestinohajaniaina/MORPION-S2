import { Grille } from "../grille/grille";

export class Manche {

    private id!: number;

    public grille!: Grille;

    constructor() {
        this.id = this.generateID();
        this.grille = new Grille();
    }

    private generateID(): number {
        return Math.floor(Math.random() * (1000));
    }

    public getId(): number {
        return this.id;
    }
}
