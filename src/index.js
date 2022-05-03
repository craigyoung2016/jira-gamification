import Resolver from '@forge/resolver';
import api, { route, storage } from "@forge/api";

const resolver = new Resolver();

// List all relevant users for issue
// - always 'myself' - current user
// - created issue
// - commenter
// - changed issue
async function listUsers(issueKey) {
  // Get issue data for creator
  const issue = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}`);
  const issueData = await issue.json();

  // Get comments
  const comments = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}/comment`);
  const commentsData = await comments.json();

  // Get changes
  const changelogs = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}/changelog`);
  const changelogsData = await changelogs.json();

  // Get current user
  const myself = await api
    .asUser()
    .requestJira(route`/rest/api/3/myself`);
  const myselfData = await myself.json();

  const authors = [];

  //////
  // Create an array of all relevant users, distinct
  //////
  
  commentsData.comments.forEach(comment => {
    if(authors.filter(author => author.accountId === comment.author.accountId).length == 0) {
      authors.push(comment.author);
    }
  });

  changelogsData.values.forEach(value => {
    if(authors.filter(author => author.accountId === value.author.accountId).length == 0) {
      authors.push(value.author);
    }
  });

  if(authors.filter(author => author.accountId === myselfData.accountId).length == 0) {
    authors.push(myselfData);
  }

  if(authors.filter(author => author.accountId === issueData.fields.creator.accountId).length == 0) {
    authors.push(issueData.fields.creator);
  }

  //////

  return authors;
};

// Add points by account id and re-calculate current level
async function addPointsToUser(accountId, pointsToAdd) {
  let data = await storage.get(`gamification-${accountId}`);
  // If not exists yet, create new
  if(!data) {
    data = {
      id: accountId,
      level: 1,
      points: 0
    };    
  }
  data.points += pointsToAdd;
  if(data.points > 0) {
    data.level = Math.ceil(data.points / 500);
  }
  await storage.set(`gamification-${accountId}`, data);
  return true;
};

// Function used by App - get users for issue
// Uses listUsers function
// Returns list of users with information needed for front-end
resolver.define('get-users', async (d) => {
  const issueKey = d.context.extension.issue.key;
  const requestedByAccountId = d.context.accountId;
  // Get award history to know, if should show Award button
  const awardHistory = await storage.get(`gamification-awards-${requestedByAccountId}`);
  const users = [];

  const authors = await listUsers(issueKey);

  await Promise.all(authors.map(async (author) => {
    try {
      const accountId = author.accountId;
      let data = await storage.get(`gamification-${accountId}`);

      // If not exists yet, create new
      if(!data) {
        data = {
          id: accountId,
          level: 1,
          points: 0
        };
        await storage.set(`gamification-${accountId}`, data);
      }

      users.push({
        author: author,
        level: data ? data.level : 'None',
        points: data ? data.points : 'None',
        isCurrentUser: accountId == requestedByAccountId,
        canAward: accountId == requestedByAccountId ? 
          false : 
          awardHistory.awards == null || awardHistory.awards.filter(award => award.id === accountId && award.issueKey === issueKey).length == 0
      });
    } catch (error) {
      
    }
  }));

  return users;
});

// Function used by App - awarding other users
// Checks if not awarding current user
// Checks if not already awarded in this issue
resolver.define('add-points', async (d) => {
  const issueKey = d.context.extension.issue.key;
  const awardAccountId = d.payload;
  const awardedByAccountId = d.context.accountId;

  // Disable award current user
  if(awardedByAccountId == awardAccountId) {
    return;
  }

  let awardHistory = await storage.get(`gamification-awards-${awardedByAccountId}`);

  if(awardHistory) {
    // Disable award multiple times in one issue
    if(awardHistory.awards.filter(award => award.id === awardAccountId && award.issueKey === issueKey).length > 0) {
      return;
    }
  }

  // If no award history for current user, create new one
  if(!awardHistory) {
    awardHistory = {
      id: awardedByAccountId,
      awards: []
    };
  }

  // Add new award to history
  awardHistory.awards.push({
    id: awardAccountId,
    issueKey: issueKey
  });

  // Save to storage
  await storage.set(`gamification-awards-${awardedByAccountId}`, awardHistory);

  // Add points to user
  return await addPointsToUser(awardAccountId, 50);
});

// Function used by App - get current points for user by account id
// Needed for real time reload of points
resolver.define('get-points-for-user', async (d) => {
  const accountId = d.payload;
  // Get data for provided account id
  const data = await storage.get(`gamification-${accountId}`);

  if(data) {
    return data.points;
  }

  // If not found in storage, return 0
  return 0;
});


//////
// Listeners for adding points in background by activity
//////

// Add points for creating an issue
export async function listenerCreated(event) {
  const accountId = event.atlassianId;
  const pointsToAdd = 5;

  return await addPointsToUser(accountId, pointsToAdd);
}

// Add poinst for assigning a worker
export async function listenerAssigned(event) {
  const accountId = event.atlassianId;
  const pointsToAdd = 5;
  
  return await addPointsToUser(accountId, pointsToAdd);
}

// Add points for adding comment
export async function listenerCommented(event) {
  const accountId = event.atlassianId;
  const pointsToAdd = 10;
  
  return await addPointsToUser(accountId, pointsToAdd);
}

// Add points for changing issue status
export async function listenerUpdated(event) {
  if(event.associatedStatuses != null) {
    const accountId = event.atlassianId;
    const pointsToAdd = 5;
    
    return await addPointsToUser(accountId, pointsToAdd);
  } else {
    return false;
  }
}

//////

export const handler = resolver.getDefinitions();