// Isolated visual QA entry: unaffected by other gameplay work in this shared checkout.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import World from '../src/realms/World';
import { DinosaurCollection } from '../src/realms/DinosaurCollection';
import { ELEMENTS, newSave } from '../src/realms/game';
import '../src/realms/realms.css';
function Review() {
  const [collection, setCollection] = useState(false);
  const id = localStorage.getItem('dino-realms-current-world');
  const realm = ELEMENTS.find(e => e.id === id)?.id ?? 'fire';
  return <main className="realms-app">
    <World save={newSave(Date.now())} realm={realm} lang={1} placing={false} moving={null} onPlace={() => {}} onSelect={() => setCollection(true)} />
    {collection && <section style={{ position: 'absolute', inset: '20px', overflow: 'auto', background: '#102733f5', border: '1px solid #b99b61', padding: '20px', zIndex: 5 }}>
      <h1>Dinosaur art review</h1><DinosaurCollection lang={1} owned={false} initialElement={realm} openOwned={() => {}} />
    </section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Review />);
