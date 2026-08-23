import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HttpService {

  constructor(private http: HttpClient) { }

  register(name: String, url: string) {
    return this.http.post(`${url}/register`, {name});
  }
}
