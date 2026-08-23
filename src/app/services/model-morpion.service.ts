import { Injectable } from '@angular/core';
import * as tf from '@tensorflow/tfjs';

@Injectable({
  providedIn: 'root',
})
export class ModelMorpionService {
  public name!: string;
  private model: tf.LayersModel | null = null;

  constructor() {}

  async loadModel(): Promise<void> {
    this.model = await tf.loadLayersModel('assets/morpion-model/model.json');
    console.log('Modèle chargé !');
    this.model.summary();
  }

  async predict(plateau: number[]): Promise<number[]> {
    if (!this.model) {
      await this.loadModel();
    }
    const input = tf.tensor2d([plateau], [1, 9]);
    const output = this.model!.predict(input) as tf.Tensor;
    const probabilities = await output.data();
    input.dispose();
    output.dispose();
    return Array.from(probabilities);
  }

  async meilleurCoup(plateau: number[]): Promise<number> {
    const probas = await this.predict(plateau);
    console.log("probas: ", probas);
    let meilleurIndex = 0;
    let meilleureProba = probas[0];
    for (let i = 1; i < probas.length; i++) {
      if (probas[i] > meilleureProba) {
        meilleureProba = probas[i];
        meilleurIndex = i;
      }
    }
    return meilleurIndex;
  }
}
