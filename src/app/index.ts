import '../styles/globals.scss';
import { createHomePage } from '../pages/home/home-page';

const app: HTMLDivElement = document.createElement('div');
app.id = 'app';

app.append(createHomePage());

document.body.append(app);
