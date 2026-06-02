import { AmpliConfig } from "../../schema";
import { useLoadNamespace } from "@/hooks/useLoadNamespace";
import { useT } from "@/hooks/useT";
import { Button } from "@/components/ui/button";
import { Lightbulb, Send, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSummaryData } from "../../helpers/summary";

interface AmpliFeaturesProps {
    props: AmpliConfig["props"]["features"];
    isLoading?: boolean;
    data: Parameters<typeof getSummaryData>[0];
}

export default function AmpliFeatures({ props, isLoading, data }: AmpliFeaturesProps) {
    useLoadNamespace("modules/ampli");
    const t = useT("modules/ampli");

    if(isLoading) {
        return null;
    }
    const summaryData = getSummaryData(data);

    const {
        headline,
        subhead,
        button,
        summary,
        howItWork,
    } = props || {};
    

    return (
        <section id="ampli-feature" className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center my-4 sm:my-6 md:my-10">
                <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
                    {headline ? t(headline) : t("AmpliFeatures.headline")}
                </h2>
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                    {subhead ? t(subhead) : t("AmpliFeatures.subhead")}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div className="p-4 forms-container">
                    <div className="min-h-52">

                    </div>
                    <Button variant="secondary" size="lg" className="w-full mt-6 bg-primary/25">
                        <Send className="mr-2" />
                        {button ? t(button) : t("AmpliFeatures.button")}
                    </Button>
                </div>
                <div className="space-y-6">
                    <Card className="p-6 bg-gradient-card border-primary/20">
                        <div className="flex items-center mb-4">
                            <Lightbulb className="h-6 w-6 text-primary mr-3" />
                            <h3 className="font-semibold text-foreground">{howItWork && howItWork.headline ? t(howItWork.headline) : t("AmpliFeatures.howItWork.headline")}</h3>
                        </div>
                        <ol className="space-y-3 text-muted-foreground">
                            <li className="flex items-start">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">1</span>
                                {howItWork && howItWork.stepOne ? t(howItWork.stepOne) : t("AmpliFeatures.howItWork.stepOne")}
                            </li>
                            <li className="flex items-start">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">2</span>
                                {howItWork && howItWork.stepTwo ? t(howItWork.stepTwo) : t("AmpliFeatures.howItWork.stepTwo")}
                            </li>
                            <li className="flex items-start">
                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">3</span>
                                {howItWork && howItWork.stepThree ? t(howItWork.stepThree) : t("AmpliFeatures.howItWork.stepThree")}
                            </li>
                        </ol>
                    </Card>

                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-foreground flex items-center">
                                <TrendingUp className="h-5 w-5 text-secondary mr-2" />
                                {summary && summary.headline ? t(summary.headline) : t("AmpliFeatures.summary.headline")}
                            </h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{summary && summary.submitted ? t(summary.submitted) : t("AmpliFeatures.summary.submitted")}</span>
                                <span className="font-semibold text-foreground">{summaryData.totalAnswers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{summary && summary.members ? t(summary.members) : t("AmpliFeatures.summary.members")}</span>
                                <span className="font-semibold text-foreground">{summaryData.totalUsers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{summary && summary.amplified ? t(summary.amplified) : t("AmpliFeatures.summary.amplified")}</span>
                                <span className="font-semibold text-secondary">{summaryData.totalLikes}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">{summary && summary.comments ? t(summary.comments) : t("AmpliFeatures.summary.comments")}</span>
                                <span className="font-semibold text-secondary">{summaryData.totalComments}</span>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
}