import islandersImage from '../../assets/images/islanders-new-shores-card.jpg';
import vacationImage from '../../assets/images/vacation-cafe-simulator-card.jpg';
import winterImage from '../../assets/images/winter-burrow-card.jpg';

export interface SliderGame {
  readonly id: string;
  readonly title: string;
  readonly image: string;
  readonly rating: number;
  readonly likes: number;
}

export const sliderGames: readonly SliderGame[] = [
  {
    id: 'islanders-new-shores',
    title: 'ISLANDERS: New Shores',
    image: islandersImage,
    rating: 4.9,
    likes: 54_200,
  },
  {
    id: 'vacation-cafe-simulator',
    title: 'Vacation Cafe Simulator',
    image: vacationImage,
    rating: 4.8,
    likes: 28_700,
  },
  {
    id: 'winter-burrow',
    title: 'Winter Burrow',
    image: winterImage,
    rating: 4.9,
    likes: 32_400,
  },
];
