import { Item } from './item';

export interface DroppedItem {
    itemConfig: Item;
    x: number;
    y: number;
    quantity: number;
} 