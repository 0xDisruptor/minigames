import vacationCafeImage from '../../assets/images/vacation-cafe-simulator-card.jpg';
import potionsImage from '../../assets/images/shelve-the-potions-card.jpg';
import winterBurrowImage from '../../assets/images/winter-burrow-card.jpg';
import heartopiaImage from '../../assets/images/heartopia-card.jpg';
import catMailImage from '../../assets/images/cat-mail-co-card.jpg';
import paliaImage from '../../assets/images/palia-card.jpg';

export interface LibraryGame {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
  rating: number;
  likes: number;
  price: number;
}

export const libraryGames: readonly LibraryGame[] = [
  {
    id: 'vacation-cafe-simulator',
    title: 'Vacation Cafe Simulator',
    category: 'Strategy',
    description:
      'Cozy Italian Vacation Cafe 🏖️ No timers, No stress 😌 cook traditional dishes 🍝 upgrade and customize 🏠 just drink Prosecco 🥂 relax and grow your dream cafe ✨',
    image: vacationCafeImage,
    rating: 4.8,
    likes: 28_700,
    price: 0,
  },
  {
    id: 'shelve-the-potions',
    title: 'Shelve the Potions!',
    category: 'Puzzle',
    description:
      "Organize 2000+ potions on shelves after the witch's cats have knocked them over, using clues around an enchanted cellar. Learn strange symbols and decipher cryptic notes.",
    image: potionsImage,
    rating: 4.7,
    likes: 21_300,
    price: 0,
  },
  {
    id: 'winter-burrow',
    title: 'Winter Burrow',
    category: 'Farm',
    description:
      'A cozy woodland survival game about a mouse restoring their childhood burrow. Explore, gather resources, craft, knit warm sweaters, bake pies and meet the locals.',
    image: winterBurrowImage,
    rating: 4.9,
    likes: 32_400,
    price: 0,
  },
  {
    id: 'heartopia',
    title: 'Heartopia',
    category: 'Strategy',
    description:
      'A multiplayer life simulation game crafted for creativity, freedom, and peace. Build your dream home, explore hobbies, and forge warm connections with friends in a cozy town.',
    image: heartopiaImage,
    rating: 4.6,
    likes: 46_800,
    price: 1.99,
  },
  {
    id: 'cat-mail-co',
    title: 'Cat Mail Co.',
    category: 'Puzzle',
    description:
      'Run a cozy cat post office. Sort and deliver parcels from the daily boat. At night, the moon reveals hidden truths about packages. Clear a strange backlog and unlock new destinations.',
    image: catMailImage,
    rating: 4.9,
    likes: 38_200,
    price: 0,
  },
  {
    id: 'palia',
    title: 'Palia',
    category: 'Strategy',
    description:
      'A free-to-play fantasy life sim adventure where you can craft, explore, and create the life and home of your dreams in a vibrant, heartwarming world.',
    image: paliaImage,
    rating: 4.8,
    likes: 89_500,
    price: 0,
  },
];
