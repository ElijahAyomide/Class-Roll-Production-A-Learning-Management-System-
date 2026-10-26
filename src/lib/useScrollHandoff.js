import { useEffect } from 'react';

// Lets the mouse wheel work naturally on pages where a list card sits under a
// header: while the page still has room to scroll, the wheel moves the PAGE
// first (so the title and summary cards scroll away); once the page has
// stopped, the wheel scrolls the list inside the card. Scrolling back up does
// the reverse.
export function useScrollHandoff(cardRef) {
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return undefined;
    const inner = card.querySelector('.table-wrap, .qlist');
    if (!inner) return undefined;

    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const maxPage = document.documentElement.scrollHeight - window.innerHeight;
      if (delta > 0 && window.scrollY < maxPage - 1) {
        e.preventDefault();
        window.scrollBy(0, delta);
      } else if (delta < 0 && inner.scrollTop <= 0 && window.scrollY > 0) {
        e.preventDefault();
        window.scrollBy(0, delta);
      }
    };
    card.addEventListener('wheel', onWheel, { passive: false });
    return () => card.removeEventListener('wheel', onWheel);
  }, [cardRef]);
}
