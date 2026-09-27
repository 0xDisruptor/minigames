import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../styles/globals.scss';

import { createHeader } from '../components/header/header';
import { createFooter } from '../components/footer/footer';
import { createAuthDialog } from '../components/dialogs/auth-dialog';
import { initRouter } from './router';

const app: HTMLDivElement = document.createElement('div');
app.id = 'app';

const outlet: HTMLDivElement = document.createElement('div');
outlet.id = 'page-content';

const authDialog = createAuthDialog();

app.append(createHeader(authDialog.open), outlet, createFooter(), authDialog.element);

document.body.append(app);

initRouter(app, outlet);
