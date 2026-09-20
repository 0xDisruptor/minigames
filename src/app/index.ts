import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../styles/globals.scss';
import { createHeader } from '../components/header/header';
import { createHomePage } from '../pages/home/home-page';
import { createFooter } from '../components/footer/footer';

const app: HTMLDivElement = document.createElement('div');
app.id = 'app';

app.append(createHeader(), createHomePage(), createFooter());

document.body.append(app);
