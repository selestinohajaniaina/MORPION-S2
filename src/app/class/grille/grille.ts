export class Grille {

    public case!: (0 | 1 | 5)[][];
    public win: (0 | 1 | 5) = 0;
    public isPlayerTour: Boolean;
    public endManche: Boolean;

    constructor() {
        this.case = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        this.isPlayerTour = true;
        this.endManche = false;
    }

    public placePion(rowPosition: number, colPosition: number, form: (0 | 1 | 5)) {
        if(this.win == 0) {
            this.case[rowPosition][colPosition] = form;
            // this.isPlayerTour = !this.isPlayerTour;
        }
    }

    public verify() {
        this.calculate(1);
        this.calculate(5);
    }

    /**
     * calcul du gagnant
     * @param symbole symbole du pion
     */
    private calculate(symbole: 1 | 5) {
        let somme = symbole * 3;
        if( this.calculRow(0) == somme || this.calculRow(1) == somme || this.calculRow(2) == somme || this.calculCol(0) == somme || this.calculCol(1) == somme || this.calculCol(2) == somme || this.calculDiag(1) == somme || this.calculDiag(2) == somme) {
            this.win = symbole;
            this.endManche = true;
            console.log(this.win, 'end game, winner, mbl mis vide');
        }
        if(this.casesVide().length == 0) {
            this.endManche = true;
            console.log('tss case vide');
            
        }
    }

    /**
     * fonction calcul la totalite du case du ligne
     * @param row - position du ligne
     * @returns nombre total du case a cette ligne
     */
    private calculRow(row: 0 | 1 |2) {
        return this.case[row][0] + this.case[row][1] + this.case[row][2];
    }

    /**
     * fonction calcul la totalite du case du colonne
     * @param col - position du colonne
     * @returns nombre total du case a cette colonne
     */
    private calculCol(col: 0 | 1 |2) {
        return this.case[0][col] + this.case[1][col] + this.case[2][col];
    }

    /**
     * fonction calcul la totalite du case du diagonnal
     * @param range - ( 1 pour diagonnal '\' et 2 pour '/') du grille
     * @returns nombre total du case a cette diagonnal
     */
    private calculDiag(range: 1 | 2) {
        return range == 1 ? this.case[0][0] + this.case[1][1] + this.case[2][2] : this.case[0][2] + this.case[1][1] + this.case[2][0];
    }

    /**
     * verifie tous les cases qui port le nombre 0
     * @returns tableau des position du case vide
     */
    casesVide() {
        let cases: [number, number][] = [];
        for (let row = 0; row < this.case.length; row++) {
          for (let col = 0; col < this.case[row].length; col++) {
            if (this.case[row][col] === 0) {
              cases.push([ row, col ]);
            }
          }
        }
    
        return cases;
      }

}
