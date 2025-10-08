import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

export default function Plans() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground">Manage your training plans</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Coming soon</h3>
            <p className="text-sm text-muted-foreground">
              Plan management features will be available soon
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
