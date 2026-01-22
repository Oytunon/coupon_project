import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Medal } from "lucide-react";

interface LeaderboardEntry {
    rank: number;
    username: string;
    points: number;
}

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    isLoading: boolean;
}

export function Leaderboard({ entries, isLoading }: LeaderboardProps) {
    if (isLoading) {
        return <div className="text-center p-8">Yükleniyor...</div>;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[100px]">Sıra</TableHead>
                        <TableHead>Kullanıcı Adı</TableHead>
                        <TableHead className="text-right">Toplam Puan</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {entries.map((entry) => (
                        <TableRow key={entry.rank}>
                            <TableCell className="font-medium flex items-center gap-2">
                                {entry.rank}
                                {entry.rank === 1 && <Medal className="h-4 w-4 text-yellow-500" />}
                                {entry.rank === 2 && <Medal className="h-4 w-4 text-gray-400" />}
                                {entry.rank === 3 && <Medal className="h-4 w-4 text-amber-600" />}
                            </TableCell>
                            <TableCell>{entry.username}</TableCell>
                            <TableCell className="text-right font-bold">
                                {entry.points.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                        </TableRow>
                    ))}
                    {entries.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center">
                                Sıralama verisi bulunamadı.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
