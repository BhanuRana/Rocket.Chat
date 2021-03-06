import { Meteor } from 'meteor/meteor';

import { callbacks } from '../../../../../app/callbacks';
import { Users } from '../../../../../app/models/server/raw';
import { settings } from '../../../../../app/settings';
import { getMaxNumberSimultaneousChat } from '../lib/Helper';
import { allowAgentSkipQueue } from '../../../../../app/livechat/server/lib/Helper';

callbacks.add('livechat.checkAgentBeforeTakeInquiry', async ({ agent, inquiry, options }) => {
	if (!settings.get('Livechat_waiting_queue')) {
		return agent;
	}

	if (!inquiry || !agent) {
		return null;
	}

	if (allowAgentSkipQueue(agent)) {
		return agent;
	}

	const { department: departmentId } = inquiry;
	const { agentId } = agent;

	const maxNumberSimultaneousChat = getMaxNumberSimultaneousChat({ agentId, departmentId });
	if (maxNumberSimultaneousChat === 0) {
		return agent;
	}

	const user = await Users.getAgentAndAmountOngoingChats(agentId, departmentId);
	if (!user) {
		return null;
	}

	const { queueInfo: { chats = 0 } = {} } = user;
	if (maxNumberSimultaneousChat <= chats) {
		callbacks.run('livechat.onMaxNumberSimultaneousChatsReached', inquiry);
		if (options.clientAction && !options.forwardingToDepartment) {
			throw new Meteor.Error('error-max-number-simultaneous-chats-reached', 'Not allowed');
		}

		return null;
	}
	return agent;
}, callbacks.priority.MEDIUM, 'livechat-before-take-inquiry');
