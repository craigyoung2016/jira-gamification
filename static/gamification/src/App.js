import React, { useEffect, useState } from 'react';
import { invoke, Modal } from '@forge/bridge';
import $ from 'jquery';

function App() {
  const [users, setUsers] = useState(null);

  async function updatePoints() {
    $('#users .user').each(async function () {      
      const accountId = $(this).attr('id');
      const pointsSpan = $(this).find('.points');
      const currentPoints = await invoke('get-points-for-user', accountId);
      const oldPoints = pointsSpan.data('points');

      if(oldPoints < currentPoints) {
        pointsSpan.text(currentPoints);
        pointsSpan.data('points', currentPoints);
      }
    });
  }

  function awardUser(accountId) {
    invoke('add-points', accountId).then(updatePoints);
    $(`#${accountId} button`).remove();    
  }

  useEffect(() => {
    invoke('get-users').then(setUsers)
  }, []); 

  useEffect(() => {
    setInterval(() => updatePoints(), 1000);
  }, []);

  const Users = () => (
    <div id='users'>
      {users.sort((a,b) => { return a.author.displayName.localeCompare(b.author.displayName) }).map(user => {
          return (
            <div id={user.author.accountId} className='user' style={{ display: 'flex' }}>
              <span>User: {user.author.displayName}</span>
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