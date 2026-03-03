import * as stopRepo from '../repo/bus-repo';

export const getFormattedSchedule = async (stopId: string) => {
    const rawStops = await stopRepo.getUpcomingStops(stopId);

    return rawStops.map(stop => ({
        ...stop,
    }));
};