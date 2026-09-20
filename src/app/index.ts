import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import '../styles/globals.scss';
import { createHeader } from '../components/header/header';
import { createHomePage } from '../pages/home/home-page';
import { createFooter } from '../components/footer/footer';
import { createAuthDialog } from '../components/dialogs/auth-dialog';

const app: HTMLDivElement = document.createElement('div');
app.id = 'app';

const authDialog = createAuthDialog();

app.append(createHeader(authDialog.open), createHomePage(), createFooter(), authDialog.element);

document.body.append(app);
