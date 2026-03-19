import { Button } from "@/components/ui/button";
export default function Header({ user, isOnline, toggleOnlineMutation }: any) {
  return (
    <header className="bg-accent text-accent-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Driver Dashboard</h1>
          <p className="text-accent-foreground/80">Welcome back, {user?.firstName || 'Driver'}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <Button onClick={() => toggleOnlineMutation.mutate()}>{isOnline ? 'Go Offline' : 'Go Online'}</Button>
        </div>
      </div>
    </header>
  );
}
