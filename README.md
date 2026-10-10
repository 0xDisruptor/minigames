# minigames

Visit Web: [Story](https://0xdisruptor.github.io/minigames/)

## Brief discription

A web application featuring two pages and two dialogs, developed from a design mockup using only **TypeScript, HTML, and SCSS**, without frameworks or prebuilt UI libraries.

**Task:** [Story-4](https://github.com/rolling-scopes-school/qualifying-stage/blob/main/tasks/minigames/story-4.md)

**Stack:**

- Vite
- Sass
- TypeScript

## Firebase configuration

Copy `.env.example` to `.env.local` and fill in the values from
the web app's `firebaseConfig` in Firebase Console.

| Environment variable        | Firebase configuration field |
| --------------------------- | ---------------------------- |
| `VITE_FIREBASE_API_KEY`     | `apiKey`                     |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain`                 |
| `VITE_FIREBASE_PROJECT_ID`  | `projectId`                  |
| `VITE_FIREBASE_APP_ID`      | `appId`                      |

Enable Email/Password and Google in Authentication → Sign-in method.
Add `localhost` and the deployed site's hostname to Authorized domains.

Restart the development server after changing `.env.local`.
The local configuration file is excluded from Git.

Run unit tests with `npm test`.
Generate the coverage report with `npm run test:coverage`.
