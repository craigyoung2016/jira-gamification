import Resolver from '@forge/resolver';
import api, { route, storage } from "@forge/api";

const resolver = new Resolver();

resolver.define('get-users', async (d) => {
  const issueKey = d.context.extension.issue.key;
  const requestedByAccountId = d.context.accountId;

  const comments = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}/comment`);
  const commentsData = await comments.json();

  const changelogs = await api
    .asUser()
    .requestJira(route`/rest/api/3/issue/${issueKey}/changelog`);
  const changelogsData = await changelogs.json();

  const myself = await api
    .asUser()
    .requestJira(route`/rest/api/3/myself`);
  const myselfData = await myself.json();

  const awardHistory = await storage.get(`gamification-awards-${requestedByAccountId}`);

  const authors = [];
  const users = [];

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

  await Promise.all(authors.map(async (author) => {
    try {
      const accountId = author.accountId;
      let data = await storage.get(`gamification-${accountId}`);
      if(!data) {
        data = {
          id: accountId,
          level: 1,
          points: 0
        };
        storage.set(`gamification-${accountId}`, data);
      }

      users.push({
        author: author,
        level: data ? data.level : 'None',
        points: data ? data.points : 'None',
        isCurrentUser: accountId == requestedByAccountId,
        canAward: accountId == requestedByAccountId ? 
          false : 
          awardHistory.awards.filter(award => award.accountId === accountId && award.issueKey === issueKey).length == 0
      });
    } catch (error) {
      
    }
  }));

  return users;
});

async function addPointsToUser(accountId, pointsToAdd) {
  let data = await storage.get(`gamification-${accountId}`);
  if(!data) {
    data = {
      id: accountId,
      level: 1,
      points: 0
    };    
  }
  data.points += pointsToAdd;
  storage.set(`gamification-${accountId}`, data);
  return true;
}

resolver.define('add-points', async (d) => {
  const issueKey = d.context.extension.issue.key;
  const awardAccountId = d.payload;
  const awardedByAccountId = d.context.accountId;

  let awardHistory = await storage.get(`gamification-awards-${awardedByAccountId}`);

  if(awardHistory) {
    if(awardHistory.awards.filter(award => award.accountId === awardAccountId && award.issueKey === issueKey).length > 0) {
      return;
    }
  }

  if(!awardHistory) {
    awardHistory = {
      accountId: awardedByAccountId,
      awards: []
    };
  }

  awardHistory.awards.push({
    accountId: awardAccountId,
    issueKey: issueKey
  });

  storage.set(`gamification-awards-${awardedByAccountId}`, awardHistory);

  return await addPointsToUser(d.payload, 50);
});

export async function listener(event) {
  console.log(event)
  const type = event.changelog.items[0].field;
  const accountId = event.atlassianId;
  let pointsToAdd = 0;

  switch(type) {
    case "assignee":
      pointsToAdd = 10;
      break;
  }

  return await addPointsToUser(accountId, pointsToAdd);
}

export const handler = resolver.getDefinitions();