export interface Order {
  id: string;
  total: string | number;
  currency: string;
  items?: { name: string; quantity: number; price: number }[];
}
