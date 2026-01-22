import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Ticket, BarChart3 } from "lucide-react";

interface UserStatsProps {
    stats: {
        total_points: number;
        rank: number;
        total_participants: number;
        coupons: any[]; // Using any[] for now, should be typed properly
    };
}

export function UserStats({ stats }: UserStatsProps) {
    const avgPoints = stats.coupons.length > 0
        ? (stats.total_points / stats.coupons.length).toFixed(2)
        : "0.00";

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Puan</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.total_points.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Kazanılan toplam puan</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sıralama</CardTitle>
                    <Medal className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.rank > 0 ? `#${stats.rank}` : "-"} <span className="text-sm font-normal text-muted-foreground">/ {stats.total_participants}</span></div>
                    <p className="text-xs text-muted-foreground">Genel sıralamadaki yeriniz</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Toplam Kupon</CardTitle>
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.coupons.length}</div>
                    <p className="text-xs text-muted-foreground">Oynanan toplam kupon</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ortalama Puan</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{avgPoints}</div>
                    <p className="text-xs text-muted-foreground">Kupon başına ortalama</p>
                </CardContent>
            </Card>
        </div>
    );
}
