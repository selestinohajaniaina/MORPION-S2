import { Pion } from "../pion/pion";

export class Bot {

    public niveau!: 'facile' | 'moyenne' | 'difficile';
    public pion!: Pion;

    constructor(PION_NON_CHOISIS: Pion, NIVEAU: 'facile' | 'moyenne' | 'difficile' = 'facile') {
        this.niveau = NIVEAU;
        this.pion = PION_NON_CHOISIS;
    }

    public static getPosition(position: [number, number][]) {
        const randomIndex = Math.floor(Math.random() * position.length);
        return position[randomIndex];
    }

}
