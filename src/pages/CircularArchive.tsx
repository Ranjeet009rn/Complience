import React from 'react';
import { Link } from 'react-router-dom';

type Circular = {
  id: string;
  title: string;
  image: string;
};

// Data using the provided images in public/Images
const circulars: Circular[] = [
  {
    id: 'rbi',
    title: 'RBI',
    image: '/Images/rbi.jpg',
  },
  {
    id: 'sebi',
    title: 'SEBI',
    image: '/Images/SEBI.jpg',
  },
];
const CircularArchive: React.FC = () => {

  return (
    <div className="p-6">
      {/* Breadcrumb (react-router Link) */}
      <nav className="text-sm text-gray-500 mb-2" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-gray-700">Dashboard</Link>
          </li>
          <li className="px-1 text-gray-400">&gt;</li>
          <li className="text-gray-700 font-medium">Circular</li>
        </ol>
      </nav>

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Circular</h1>
        <p className="text-sm text-gray-500">RBI and SEBI archives</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-6">
        {circulars.map((c) => (
          <Link
            key={c.id}
            to={`/circular/${c.id.toLowerCase()}`}
            className="group bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 overflow-hidden flex flex-col hover:-translate-y-0.5 hover:border-indigo-200 hover:ring-1 hover:ring-indigo-100"
            title={c.title}
          >
            {/* Standard card media area (~200px height) */}
            <div className="w-full h-52 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
              <img
                src={c.image}
                alt={c.title}
                className="max-h-40 max-w-[85%] object-contain drop-shadow-sm transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="px-4 py-3">
              <h3 className="font-semibold text-gray-900 text-center tracking-wide">
                {c.title}
              </h3>
              <p className="mt-0.5 text-xs text-center text-gray-500">Circular Archive</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CircularArchive;
