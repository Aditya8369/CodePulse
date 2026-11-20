import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class GithubGraphqlService {
  private readonly logger = new Logger(GithubGraphqlService.name);
  private readonly graphqlEndpoint = 'https://api.github.com/graphql';

  async fetchBatchedUserProfile(username: string, token?: string) {
    this.logger.log(`Executing batched GitHub GraphQL query for: ${username}`);

    const query = `
      query GetDeveloperProfile($login: String!) {
        user(login: $login) {
          name
          login
          avatarUrl
          bio
          location
          company
          websiteUrl
          followers { totalCount }
          following { totalCount }
          repositories(first: 50, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
            nodes {
              name
              description
              stargazerCount
              forkCount
              primaryLanguage {
                name
                color
              }
            }
          }
          contributionsCollection {
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `;

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'CodePulse-App',
      };
      if (token) {
        headers['Authorization'] = `bearer ${token}`;
      }

      const response = await axios.post(
        this.graphqlEndpoint,
        { query, variables: { login: username } },
        { headers, timeout: 5000 }
      );

      return response.data?.data?.user || null;
    } catch (err: any) {
      this.logger.warn(`GraphQL query failed, falling back to mock or REST: ${err.message}`);
      return null;
    }
  }
}
