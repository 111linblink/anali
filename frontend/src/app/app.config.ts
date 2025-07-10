import { importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes'; // Aquí defines tus rutas

export const appConfig = {
  providers: [
    provideRouter(routes),
    // otros providers si tienes (como HTTP, etc)
  ]
};
