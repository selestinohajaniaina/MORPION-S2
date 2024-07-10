export class Pion {

    private id!: number;

    public form!: 'x' | 'o';

    constructor(FORM: 'x' | 'o') {
        this.id = this.generateID();
        this.form = FORM;
    }

    private generateID(): number {
        return Math.floor(Math.random() * (1000));
    }

    public getId(): number {
        return this.id;
    }
}
