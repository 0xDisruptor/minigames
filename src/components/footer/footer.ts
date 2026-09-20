import './footer.scss';

import logoUrl from '../../assets/images/logo.svg';
import shareUrl from '../../assets/icons/community-share.svg';
import chatUrl from '../../assets/icons/community-chat.svg';
import rssUrl from '../../assets/icons/community-rss.svg';
import schoolUrl from '../../assets/icons/rs-school.svg';
import profileUrl from '../../assets/icons/developer-profile.svg';

function createLink(text: string, href: string, className: string): HTMLAnchorElement {
  const link: HTMLAnchorElement = document.createElement('a');
  link.className = className;
  link.href = href;
  link.textContent = text;

  return link;
}

function createImage(url: string, className: string, size: number): HTMLImageElement {
  const image: HTMLImageElement = document.createElement('img');
  image.className = className;
  image.src = url;
  image.alt = '';
  image.width = size;
  image.height = size;

  return image;
}

function createLinkGroup(title: string, labels: readonly string[]): HTMLElement {
  const navigation: HTMLElement = document.createElement('nav');
  navigation.className = 'footer__group';
  navigation.setAttribute('aria-label', title);

  const heading: HTMLHeadingElement = document.createElement('h2');
  heading.className = 'footer__heading';
  heading.textContent = title;

  const list: HTMLUListElement = document.createElement('ul');
  list.className = 'footer__list';

  for (const label of labels) {
    const item: HTMLLIElement = document.createElement('li');
    item.append(createLink(label, '#/', 'footer__link'));
    list.append(item);
  }

  navigation.append(heading, list);

  return navigation;
}

function createCommunity(): HTMLElement {
  const navigation: HTMLElement = document.createElement('nav');
  navigation.className = 'footer__group footer__community';
  navigation.setAttribute('aria-label', 'Community');

  const heading: HTMLHeadingElement = document.createElement('h2');
  heading.className = 'footer__heading';
  heading.textContent = 'Community';

  const list: HTMLUListElement = document.createElement('ul');
  list.className = 'footer__socials';

  const socialIcons: readonly [string, string][] = [
    ['Share', shareUrl],
    ['Community chat', chatUrl],
    ['RSS feed', rssUrl],
  ];

  for (const [label, url] of socialIcons) {
    const item: HTMLLIElement = document.createElement('li');

    const link: HTMLAnchorElement = createLink('', '#/', 'footer__social-link');
    link.setAttribute('aria-label', label);
    link.append(createImage(url, 'footer__social-icon', 40));

    item.append(link);
    list.append(item);
  }

  navigation.append(heading, list);

  return navigation;
}

function createCreditLink(text: string, href: string, iconUrl: string): HTMLAnchorElement {
  const link: HTMLAnchorElement = createLink('', href, 'footer__credit-link');

  const label: HTMLSpanElement = document.createElement('span');
  label.textContent = text;

  link.append(createImage(iconUrl, 'footer__credit-icon', 24), label);

  return link;
}

export function createFooter(): HTMLElement {
  const footer: HTMLElement = document.createElement('footer');
  footer.className = 'footer';

  const top: HTMLDivElement = document.createElement('div');
  top.className = 'footer__top';

  const brand: HTMLDivElement = document.createElement('div');
  brand.className = 'footer__brand';

  const logo: HTMLAnchorElement = createLink('', '#/', 'footer__logo');
  logo.setAttribute('aria-label', 'MiniGames home');

  const logoText: HTMLSpanElement = document.createElement('span');
  logoText.textContent = 'MiniGames';

  logo.append(createImage(logoUrl, 'footer__logo-image', 32), logoText);

  const description: HTMLParagraphElement = document.createElement('p');
  description.className = 'footer__description';
  description.textContent =
    'Take a short break and have fun. Hundreds of curated casual mini-games right in your web browser. No download required.';

  brand.append(logo, description);

  const groups: HTMLDivElement = document.createElement('div');
  groups.className = 'footer__groups';

  groups.append(
    createLinkGroup('Explore', ['Home', 'Library', 'Categories', 'Tournaments']),
    createLinkGroup('Company', ['About Us', 'Contact', 'Privacy Policy', 'Terms of Service']),
    createCommunity(),
  );

  top.append(brand, groups);

  const bottom: HTMLDivElement = document.createElement('div');
  bottom.className = 'footer__bottom';

  const copyright: HTMLParagraphElement = document.createElement('p');
  copyright.className = 'footer__copyright';
  copyright.textContent = '© 2026 MiniGames. All rights reserved.';

  const school: HTMLAnchorElement = createCreditLink(
    'RS School',
    'https://rs.school/courses/short-track',
    schoolUrl,
  );

  const author: HTMLAnchorElement = createCreditLink(
    '@0xDisruptor',
    'https://github.com/0xDisruptor',
    profileUrl,
  );

  const tagline: HTMLParagraphElement = document.createElement('p');
  tagline.className = 'footer__tagline';
  tagline.textContent = 'Designed with love';

  bottom.append(copyright, school, author, tagline);
  footer.append(top, bottom);

  return footer;
}
