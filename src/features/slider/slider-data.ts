import vacationImage from '../../assets/images/vacation-cafe-simulator-card.jpg';
import winterImage from '../../assets/images/winter-burrow-card.jpg';
import potionsImage from '../../assets/images/shelve-the-potions-card.jpg';
import heartopiaImage from '../../assets/images/heartopia-card.jpg';
import paliaImage from '../../assets/images/palia-card.jpg';
import catMailImage from '../../assets/images/cat-mail-co-card.jpg';
import tinyGladeImage from '../../assets/images/tiny-glade-card.jpg';
import tailsideImage from '../../assets/images/tailside-cozy-cafe-sim-card.jpg';
import islandersImage from '../../assets/images/islanders-new-shores-card.jpg';

export interface SliderGame {
  readonly id: string;
  readonly title: string;
  readonly image: string;
  readonly rating: number;
  readonly likes: number;
}

export const sliderGames: readonly SliderGame[] = [
  {
    id: 'vacation-cafe-simulator',
    title: 'Vacation Cafe Simulator',
    image: vacationImage,
    rating: 4.8,
    likes: 28_750,
  },
  {
    id: 'winter-burrow',
    title: 'Winter Burrow',
    image: winterImage,
    rating: 4.9,
    likes: 32_400,
  },
  {
    id: 'shelve-the-potions',
    title: 'Shelve the Potions!',
    image: potionsImage,
    rating: 4.7,
    likes: 21_300,
  },
  {
    id: 'heartopia',
    title: 'Heartopia',
    image: heartopiaImage,
    rating: 4.6,
    likes: 46_800,
  },
  {
    id: 'palia',
    title: 'Palia',
    image: paliaImage,
    rating: 4.8,
    likes: 89_500,
  },
  {
    id: 'cat-mail-co',
    title: 'Cat Mail Co.',
    image: catMailImage,
    rating: 4.9,
    likes: 38_200,
  },
  {
    id: 'tiny-glade',
    title: 'Tiny Glade',
    image: tinyGladeImage,
    rating: 4.9,
    likes: 67_300,
  },
  {
    id: 'tailside-cozy-cafe-sim',
    title: 'Tailside: Cozy Cafe Sim',
    image: tailsideImage,
    rating: 4.8,
    likes: 35_600,
  },
  {
    id: 'islanders-new-shores',
    title: 'ISLANDERS: New Shores',
    image: islandersImage,
    rating: 4.9,
    likes: 54_200,
  },
];
