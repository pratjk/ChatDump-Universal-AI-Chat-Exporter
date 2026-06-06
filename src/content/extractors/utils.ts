export async function scrollToLoadAll(
  container: Element,
  selector: string,
  maxAttempts = 30
): Promise<number> {
  let previousCount = 0;
  let stableRounds = 0;
  
  for (let i = 0; i < maxAttempts; i++) {
    // Scroll to top to trigger lazy loading of older messages
    container.scrollTo({ top: 0, behavior: 'auto' });
    
    // Wait for React to render new messages
    await new Promise(r => setTimeout(r, 1200));
    
    const currentCount = document.querySelectorAll(selector).length;
    
    if (currentCount === previousCount) {
      stableRounds++;
      if (stableRounds >= 2) break; // No new messages after 2 attempts
    } else {
      stableRounds = 0;
      previousCount = currentCount;
    }
  }
  
  return previousCount;
}
