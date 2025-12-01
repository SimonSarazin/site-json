import { Answer, User } from "@communecter/cocolight-api-client";
interface AmpliDataResponse {
    answer: Answer;
    data: Record<string, any>;
    user?: User | Record<string, string> | null;
}

interface UserWithContributions {
    user: string | User | Record<string, string> | null;
    contributionCount: number;
}

const getSummaryData = (data: AmpliDataResponse[]) => {
    let totalLikes = 0;
    let totalComments = 0;
    const userContributionsMap = new Map<string, UserWithContributions>();

    data.forEach((item) => {
        const user = item.answer.serverData.user as User | undefined;
        totalLikes += (typeof item.answer.serverData.voteCount != "undefined" && item.answer.serverData.voteCount && typeof item.answer.serverData.voteCount.like != "undefined" && item.answer.serverData.voteCount.like > 0 ? 1 : 0);
        totalComments += (typeof item.answer.serverData.comments != "undefined" && item.answer.serverData.comments && Object.keys(item.answer.serverData.comments).length > 0 ? 1 : 0);
        const userId = user?.serverData && typeof user?.serverData === 'object' && '_id' in user?.serverData 
            ? String(user?.serverData._id) 
            : JSON.stringify(user?.serverData);
        if (userContributionsMap.has(userId)) {
            const existing = userContributionsMap.get(userId)!;
            existing.contributionCount++;
        } else {
            userContributionsMap.set(userId, {
                user: item.answer.serverData.user || null,
                contributionCount: 1
            });
        }
    });
    const uniqueUsers = Array.from(userContributionsMap.values());
    const totalAnswers = data.length;
    const totalUsers = uniqueUsers.length;
    return {
        totalAnswers,
        totalUsers,
        totalLikes,
        totalComments,
        users: uniqueUsers
    };

}

export { getSummaryData };