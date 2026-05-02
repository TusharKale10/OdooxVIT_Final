import CategoryCard from './CategoryCard.jsx';
import { CATEGORIES } from '../data/categories';
import '../styles/category.css';

export default function CategoryGrid({
  heading = 'Explore by category',
  subheading = 'Hover (or tap) any tile to see what each vertical covers — then click to dive in.',
}) {
  return (
    <section aria-labelledby="cat-grid-heading" className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 id="cat-grid-heading" className="text-xl sm:text-2xl font-bold text-ink-900">{heading}</h2>
          <p className="text-sm text-ink-500">{subheading}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {CATEGORIES.map((c) => <CategoryCard key={c.id} category={c} />)}
      </div>
    </section>
  );
}
