import React, { useEffect, useState } from 'react';
import { invoke, Modal } from '@forge/bridge';
import $ from 'jquery';

function App() {
  const [users, setUsers] = useState(null);

  async function updatePoints() {
    const updatedUsers = await invoke('get-users');

    for(const i in updatedUsers) {
      const user = updatedUsers[i];
      const pointsSpan = $(`#${user.author.accountId} .points`);
      const oldPoints = pointsSpan.data('points');
      if(oldPoints < user.points) {
        pointsSpan.text(user.points);
        pointsSpan.data('points', user.points);
      }
    }
  }

  function awardUser(accountId) {
    invoke('add-points', accountId).then(updatePoints);
    $(`#${accountId} button`).remove();    
  }

  useEffect(() => {
    invoke('get-users').then(setUsers)
  }, []); 

  useEffect(() => {
    setInterval(() => updatePoints(), 3000);
  }, []);

  const Users = () => (
    <div>
      {users.sort((a,b) => { return a.author.displayName.localeCompare(b.author.displayName) }).map(user => {
          return (
            <div id={user.author.accountId} style={{ display: 'flex' }}>
              <span>{user.author.displayName}</span>
              <span className='points' data-points={user.points}>{user.points}</span>
              { !user.isCurrentUser && user.canAward && (
                <button onClick={() => {
                  awardUser(user.author.accountId);
                }}>Ocenit</button>
              ) }
              { !user.isCurrentUser && !user.canAward && (
                <span>Již oceněn</span>
              ) }
            </div>
          );
        })}
    </div>
  );

  return (
    <div>
      {users ? (<Users />) : 'Načítání...'}
    </div>
  );
}

export default App;