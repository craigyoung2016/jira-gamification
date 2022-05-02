import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import $ from 'jquery';

function App() {
  const [users, setUsers] = useState(null);
  const audio = new Audio('./sounds/points-joao-janz.wav');

  async function updatePoints() {
    $('#users .user').each(async function () {      
      const accountId = $(this).attr('id');
      const pointsSpan = $(this).find('.points');
      const currentPoints = await invoke('get-points-for-user', accountId);
      const oldPoints = pointsSpan.data('points');

      if(oldPoints < currentPoints) {
        pointsSpan.data('points', currentPoints);

        pointsSpan.addClass('points-changing');
        setTimeout(function() {
          pointsSpan.removeClass('points-changing')
        }, 1000);

        $({points: oldPoints}).animate({points: currentPoints}, {
          duration: 1000,
          step: function() {
            pointsSpan.text(`${Math.ceil(this.points)}b`);
          }
        });

        if($(this).data('is-current')) {
          audio.play();
        }
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
            <div id={user.author.accountId} data-is-current={user.isCurrentUser ? true : false} className='user'>
              <div className='user-info'>
                <span className='user-name'>{user.author.displayName}</span>
                <span className='user-level'>{user.level}</span>
              </div>

              { !user.isCurrentUser && user.canAward && (
                <button onClick={() => {
                  awardUser(user.author.accountId);
                }}>Ocenit</button>
              ) }
              { !user.isCurrentUser && !user.canAward && (
                <span>Již oceněn</span>
              ) }
              
              <span className='points' data-points={user.points}>{user.points}b</span>
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