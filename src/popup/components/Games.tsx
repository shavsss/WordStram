import React from 'react';
import { GameLauncher } from '../../games';

/**
 * Games component for the popup
 * Renders the GameLauncher to let users select and play vocabulary games
 */
const Games: React.FC = () => {
  return (
    <div className="games-container">
      <GameLauncher />
    </div>
  );
};

export default Games; 