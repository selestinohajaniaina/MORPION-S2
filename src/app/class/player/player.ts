import { Pion } from "../pion/pion";

export class Player {

    private id!: number;
    
    public name!: String;
    public pion!: Pion;

    constructor(NAME:String, PION_CHOISIS: Pion) {
        this.id = this.generateID();
        this.pion = PION_CHOISIS;
        this.name = NAME;
    }

    private generateID(): number {
        return Math.floor(Math.random() * (1000));
    }

    public getId(): number {
        return this.id;
    }

}
